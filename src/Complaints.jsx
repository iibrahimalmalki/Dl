import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import SweaterTickets from"./SweaterTickets";
import{VIOLATIONS,SEVERITY,byCode,objectionState,internalDeadline,seriousRepeat}from"./violations";
// ألوان الخطورة على الشاشة بالرموز (violations.js يبقى بألوانه الصريحة)
const cmx=c=>`color-mix(in srgb,var(--${c}) 35%,transparent)`;
const SEV_TK={critical:["bad-ink","bad-bg","bad"],high:["warn-ink","warn-bg","warn"],medium:["warn-ink","warn-bg","warn"],low:["info-ink","info-bg","info"]};
const SEV=Object.fromEntries(Object.entries(SEVERITY).map(([k,v])=>{const t=SEV_TK[k];return[k,t?{...v,color:`var(--${t[0]})`,bg:`var(--${t[1]})`,bd:cmx(t[2])}:v];}));

export default function Complaints({opId,me,owner}){
  const[tab,setTab]=useState("tickets");
  return(<div className="cmw">
    <style>{`.cmw-tabs{display:flex;gap:6px;background:var(--mut-2);border-radius:12px;padding:4px;margin-bottom:14px;max-width:520px}
.cmw-tab{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border:none;border-radius:9px;background:none;font-family:inherit;font-size:12.5px;font-weight:800;color:var(--mut);cursor:pointer}
.cmw-tab.on{background:var(--glass);color:var(--ink);box-shadow:0 1px 2px rgba(16,24,40,.08)}`}</style>
    <div className="cmw-tabs">
      <button className={"cmw-tab"+(tab==="tickets"?" on":"")} onClick={()=>setTab("tickets")}><Icon n="complaints" s={15}/> شكاوى سويتر (العملاء)</button>
      <button className={"cmw-tab"+(tab==="internal"?" on":"")} onClick={()=>setTab("internal")}><Icon n="alert" s={15}/> المخالفات الداخلية</button>
    </div>
    {tab==="tickets"?<SweaterTickets opId={opId} me={me} owner={owner}/>:<InternalViolations opId={opId}/>}
  </div>);
}

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayStr=()=>{const d=new Date();return d.toISOString().slice(0,10);};
const fmtRemain=ms=>{if(ms<=0)return"منتهية";const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);if(h>=24)return`${Math.floor(h/24)} يوم ${h%24} س`;return`${h} س ${m} د`;};
const STATUS={registered:{ar:"مسجّلة",color:"var(--warn-ink)",bg:"var(--warn-bg)"},objected:{ar:"معترَض عليها",color:"var(--info-ink)",bg:"var(--info-bg)"},confirmed:{ar:"مؤكّدة (غرامة)",color:"var(--bad-ink)",bg:"var(--bad-bg)"},dismissed:{ar:"مُلغاة",color:"var(--ok-ink)",bg:"var(--ok-bg)"}};

function InternalViolations({opId}){
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[emps,setEmps]=useState([]);
  const[rows,setRows]=useState([]);
  const[showAdd,setShowAdd]=useState(false);
  const[f,setF]=useState({sweater_id:"",code:"",date:todayStr(),time:"12:00",fine:"",evidence:""});
  const toast=useToast();
  const[msg,setMsgRaw]=useState(null);const[saving,setSaving]=useState(false);
  // رسائل النجاح → Toast؛ الأخطاء تبقى بجانب النموذج
  const setMsg=m=>{if(m&&m.ok){toast.ok(m.t,undefined,m.t.length>60?7000:undefined);setMsgRaw(null);}else setMsgRaw(m);};

  useEffect(()=>{(async()=>{
    setLoading(true);setMsg(null);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id,operator_id").not("employee_id","is",null).order("employee_id");
    setEmps(e||[]);
    let q=supabase.from("violations").select("*").eq("period",period).order("logged_at",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setRows(data||[]);
    setLoading(false);
  })();},[period,opId]);

  const cat=byCode(f.code);
  const empBySid=useMemo(()=>{const m={};emps.forEach(e=>{if(e.employee_id)m[String(e.employee_id).trim()]=e;});return m;},[emps]);

  const add=async()=>{
    if(!f.sweater_id||!f.code){setMsg({ok:false,t:"اختر البايكر ونوع المخالفة"});return;}
    setSaving(true);setMsg(null);
    try{
      const c=byCode(f.code);
      const logged_at=new Date(`${f.date}T${f.time||"12:00"}`).toISOString();
      const os=objectionState(logged_at,c.win);
      const emp=empBySid[String(f.sweater_id).trim()];
      const row={operator_id:(opId&&opId!=="all")?opId:null,period:f.date.slice(0,7),employee_id:emp?.id||null,sweater_id:f.sweater_id,biker_name:emp?.full_name||"",code:c.code,severity:c.sev,base_fine:c.fine,fine_applied:f.fine!==""?Number(f.fine):c.fine,logged_at,win_hours:c.win,objection_deadline:os.deadline,internal_deadline:internalDeadline(logged_at),status:"registered",evidence:f.evidence||null};
      const{data,error}=await supabase.from("violations").insert(row).select().single();
      if(error)throw error;
      if(row.period===period)setRows(p=>[data,...p]);
      setShowAdd(false);setF({sweater_id:"",code:"",date:todayStr(),time:"12:00",fine:"",evidence:""});
      setMsg({ok:true,t:"تم تسجيل المخالفة"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };
  const setStatus=async(row,status)=>{
    const{error}=await supabase.from("violations").update({status}).eq("id",row.id);
    if(!error)setRows(p=>p.map(r=>r.id===row.id?{...r,status}:r));
  };
  const del=async(row)=>{if(!confirm("حذف هذه المخالفة؟"))return;const{error}=await supabase.from("violations").delete().eq("id",row.id);if(error){toast.bad("تعذّر الحذف",error.message);return;}setRows(p=>p.filter(r=>r.id!==row.id));toast.ok("تم حذف المخالفة");};

  const totals=useMemo(()=>{
    const confirmedFines=rows.filter(r=>r.status==="confirmed").reduce((a,r)=>a+Number(r.fine_applied||0),0);
    const open=rows.filter(r=>{const os=objectionState(r.logged_at,r.win_hours);return os.open;}).length;
    const repeats=rows.filter(r=>seriousRepeat(rows,r.sweater_id,r.code,r.logged_at)).length;
    return{count:rows.length,confirmedFines,open,repeats};
  },[rows]);

  if(loading)return <div className="g-skel" style={{height:280}}/>;

  return(<div className="cm">
    <style>{CSS}</style>
    <div className="cm-bar">
      <div className="cm-month"><Icon n="calendar" s={16}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <button className="cm-btn" onClick={()=>{setShowAdd(!showAdd);setMsg(null);}}><Icon n={showAdd?"x":"plus"} s={15}/> {showAdd?"إغلاق":"تسجيل مخالفة"}</button>
    </div>
    {msg&&<div className={"cm-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {/* نموذج التسجيل */}
    {showAdd&&<div className="cm-form">
      <div className="cm-grid">
        <label className="cm-fld"><span>البايكر</span>
          <select value={f.sweater_id} onChange={e=>setF({...f,sweater_id:e.target.value})}>
            <option value="">اختر البايكر…</option>
            {emps.map(e=><option key={e.id} value={e.employee_id}>{e.full_name} · #{e.employee_id}</option>)}
          </select>
        </label>
        <label className="cm-fld cm-wide"><span>المخالفة (POL-QUA-001)</span>
          <select value={f.code} onChange={e=>setF({...f,code:e.target.value,fine:""})}>
            <option value="">اختر المخالفة…</option>
            {["critical","high","medium","low"].map(sv=><optgroup key={sv} label={SEVERITY[sv].ar+" — "+SEVERITY[sv].range+" ر"}>
              {VIOLATIONS.filter(v=>v.sev===sv).map(v=><option key={v.code} value={v.code}>{v.code}. {v.ar} — {v.fine}{v.unit} ر</option>)}
            </optgroup>)}
          </select>
        </label>
        <label className="cm-fld"><span>تاريخ التسجيل في سويتر</span><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label>
        <label className="cm-fld"><span>الوقت</span><input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label>
        <label className="cm-fld"><span>الغرامة المعتمدة (ر)</span><input type="number" step="0.5" value={f.fine} onChange={e=>setF({...f,fine:e.target.value})} placeholder={cat?String(cat.fine):"0"}/></label>
      </div>
      {cat&&<div className="cm-preview">
        <span className="cm-chip" style={{background:SEV[cat.sev].bg,color:SEV[cat.sev].color,borderColor:SEV[cat.sev].bd}}>{SEVERITY[cat.sev].ar}</span>
        <span className="cm-pv">نافذة الاعتراض: <b>{cat.win==null?"لا يوجد اعتراض":cat.win===72?"3 أيام":cat.win+" ساعة"}</b></span>
        <span className="cm-pv">عند التكرار: <b>{cat.repeat}</b></span>
        {cat.note&&<span className="cm-pv cm-note-i"><Icon n="alert" s={11}/> {cat.note}</span>}
      </div>}
      <label className="cm-fld" style={{marginTop:10}}><span>دليل / ملاحظة (اختياري)</span><input value={f.evidence} onChange={e=>setF({...f,evidence:e.target.value})} placeholder="رابط صورة أو وصف الدليل"/></label>
      <button className="cm-btn ok" style={{marginTop:12,width:"100%"}} onClick={add} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ التسجيل…":"تسجيل المخالفة"}</button>
    </div>}

    {/* ملخص */}
    <div className="cm-kpis">
      <K ic="complaints" c="var(--warn-ink)" bg="var(--warn-bg)" t="مخالفات الشهر" v={totals.count}/>
      <K ic="payroll" c="var(--bad-ink)" bg="var(--bad-bg)" t="غرامات مؤكّدة" v={AR(totals.confirmedFines)} sar/>
      <K ic="clock" c="var(--info-ink)" bg="var(--info-bg)" t="نوافذ اعتراض مفتوحة" v={totals.open}/>
      <K ic="alert" c="var(--warn-ink)" bg="var(--warn-bg)" t="تكرار جسيم" v={totals.repeats}/>
    </div>
    <div className="cm-hint"><Icon n="alert" s={13}/> نافذة اعتراض سويتر تبدأ من وقت التسجيل. للبايكر حق الاعتراض مرة واحدة خلال 48 ساعة للمالك بدليل كتابي. رفض سويتر نهائي.</div>

    {/* القائمة */}
    {rows.length===0?<div className="cm-empty"><div className="cm-empty-ic"><Icon n="complaints" s={30}/></div><h3>لا مخالفات مسجّلة في {periodLabel(period)}</h3><p>سجّل المخالفات الواردة من تقارير سويتر أو المراقب الميداني، وسيحسب النظام نافذة الاعتراض والغرامة تلقائياً.</p></div>:
    rows.map(r=>{const c=byCode(r.code)||{};const sev=SEV[r.severity]||SEV.low;const os=objectionState(r.logged_at,r.win_hours);const st=STATUS[r.status]||STATUS.registered;const rep=seriousRepeat(rows,r.sweater_id,r.code,r.logged_at);return(
      <div className="cm-card" key={r.id} style={{borderInlineStartColor:sev.color}}>
        <div className="cm-c-top">
          <div style={{flex:1,minWidth:0}}>
            <div className="cm-c-h"><span className="cm-code" style={{background:sev.bg,color:sev.color}}>{r.code}</span><b>{c.ar||"مخالفة"}</b></div>
            <div className="cm-c-sub"><span>{r.biker_name||"—"} · #{r.sweater_id}</span><span className="cm-dot">·</span><span>{new Date(r.logged_at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span></div>
          </div>
          <div className="cm-fine">{AR(r.fine_applied)}<i>ر</i></div>
        </div>
        <div className="cm-chips">
          <span className="cm-chip" style={{background:sev.bg,color:sev.color,borderColor:sev.bd}}>{sev.ar}</span>
          {os.none?<span className="cm-chip mut">لا اعتراض</span>:os.open?<span className="cm-chip open"><Icon n="clock" s={11}/> اعتراض سويتر: {fmtRemain(os.remainingMs)}</span>:<span className="cm-chip mut">نافذة سويتر منتهية</span>}
          {rep&&<span className="cm-chip rep"><Icon n="alert" s={11}/> تكرار جسيم</span>}
        </div>
        {r.evidence&&<div className="cm-ev"><Icon n="link" s={12}/> {r.evidence}</div>}
        <div className="cm-actions">
          <span className="cm-status" style={{background:st.bg,color:st.color}}><span className="cm-sdot" style={{background:st.color}}/>{st.ar}</span>
          <div style={{flex:1}}/>
          {["registered","objected","confirmed","dismissed"].map(s=><button key={s} className={"cm-sb"+(r.status===s?" on":"")} onClick={()=>setStatus(r,s)}>{STATUS[s].ar}</button>)}
          <button className="cm-del" onClick={()=>del(r)}><Icon n="trash" s={13}/></button>
        </div>
      </div>);})}
  </div>);
}
function K({ic,c,bg,t,v,sar}){return(<div className="cm-kpi"><span className="cm-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="cm-kv">{v}{sar&&<i> ر</i>}</div><div className="cm-kl">{t}</div></div></div>);}

const CSS=`
.cm{--b:var(--p)}
.cm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cm-month{display:flex;align-items:center;gap:7px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:11px;padding:7px 11px;color:var(--mut)}
.cm-month input{border:none;outline:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none}
.cm-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:var(--ink);color:var(--bg);font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.cm-btn.ok{background:linear-gradient(135deg,var(--ok),color-mix(in srgb,var(--ok) 72%,black))}
.cm-btn:disabled{opacity:.55}
.cm-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.cm-msg.ok{background:var(--ok-bg);color:var(--ok-ink)}.cm-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.cm-form{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:var(--shadow)}
.cm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cm-fld{display:flex;flex-direction:column;gap:4px}
.cm-fld.cm-wide{grid-column:1/-1}
.cm-fld span{font-size:11px;color:var(--mut);font-weight:600}
.cm-fld select,.cm-fld input{border:1px solid var(--line-2);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);outline:none;background:var(--glass-3);width:100%;box-sizing:border-box}
.cm-fld select:focus,.cm-fld input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.cm-preview{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;padding:10px 12px;background:var(--soft);border:1px solid var(--line);border-radius:11px}
.cm-pv{font-size:11.5px;color:var(--mut)}.cm-pv b{color:var(--ink)}
.cm-note-i{display:inline-flex;align-items:center;gap:4px;color:var(--warn-ink)}
.cm-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:700;border:1px solid transparent}
.cm-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.cm-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:var(--shadow)}
.cm-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.cm-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.cm-kv i{font-size:11px;color:var(--mut-2);font-weight:600;font-style:normal}
.cm-kl{font-size:11px;color:var(--mut);font-weight:600}
.cm-hint{display:flex;align-items:flex-start;gap:7px;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);color:var(--warn-ink);font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:14px;line-height:1.6}
.cm-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-inline-start:3px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:var(--shadow)}
.cm-c-top{display:flex;align-items:flex-start;gap:12px}
.cm-c-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.cm-c-h b{font-size:13.5px;font-weight:800;color:var(--ink)}
.cm-code{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex:none}
.cm-c-sub{font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cm-dot{color:var(--mut-2)}
.cm-fine{font-size:19px;font-weight:800;color:var(--bad-ink);letter-spacing:-.5px;flex:none}.cm-fine i{font-size:11px;color:var(--mut-2);font-weight:600;font-style:normal;margin-inline-start:2px}
.cm-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.cm-chips .mut{background:var(--soft);color:var(--mut-2)}
.cm-chips .open{background:var(--info-bg);color:var(--info-ink);border-color:color-mix(in srgb,var(--info) 35%,transparent)}
.cm-chips .rep{background:var(--bad-bg);color:var(--bad-ink);border-color:color-mix(in srgb,var(--bad) 35%,transparent)}
.cm-ev{display:flex;align-items:center;gap:5px;margin-top:9px;font-size:11.5px;color:var(--mut);background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:6px 10px;word-break:break-all}
.cm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}
.cm-status{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:800}
.cm-sdot{width:6px;height:6px;border-radius:50%}
.cm-sb{padding:5px 9px;border-radius:8px;border:1px solid var(--line);background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-family:inherit;font-size:10.5px;font-weight:700;color:var(--mut);cursor:pointer}
.cm-sb.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.cm-del{padding:5px 8px;border-radius:8px;border:1px solid color-mix(in srgb,var(--bad) 35%,transparent);background:var(--glass-2);color:var(--bad-ink);cursor:pointer;display:inline-flex;align-items:center}
.cm-empty{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px dashed var(--line);border-radius:16px;padding:40px 24px;text-align:center}
.cm-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--warn-bg),var(--warn-bg));color:var(--warn-ink)}
.cm-empty h3{font-size:16px;margin:0 0 8px}.cm-empty p{color:var(--mut);font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.cm-kpis{grid-template-columns:1fr 1fr}.cm-grid{grid-template-columns:1fr}}
`;
