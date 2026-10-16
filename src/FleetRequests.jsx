import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{useToast}from"./ui";
import TestBadge from"./TestBadge";
import{markTest,realBy}from"./testSandbox";
import{FUEL_STATUS,OIL_STATUS,statusOf,CHANNELS,channelAr,alertAr,ALERT_KINDS,SETTINGS,settingError,parseNum,adminRpcError,splitRequests,splitOil,since,alertsByVehicle,monthlyCostPerKm,riyadhMonth}from"./fleetRequests";
import{pendingFills,pricePerLiter,SOURCE_AR,transferFormError,walletAdminError,fillStatus,sar}from"./fuelWallet";

// «الأسطول ← الطلبات والتنبيهات»: رصيد الوقود (دفعات بانتظار التحويل، تعبئات بانتظار الاعتماد، رصيد كل بايكر) + الزيت + fleet_alerts() + الحدود.
// الصلاحية: وحدة fleet_alerts (عرض = القراءة، تعديل = التحويل/الرفض ومراجعة التعبئات والإرسال لسويتر والاعتماد وضبط الحدود) — المالك دائماً.
// الرصيد والدفعات: docs/sql/fuel_wallet.sql (fuel_balances، transfer_fuel_request بالأسماء، reject_fuel_request، review_fuel_fill).
// كل كتابة عبر دوال القاعدة (docs/sql/fleet_requests.sql). التنبيهات لكل دراجة لا لكل درّاج، ولا تصل الدرّاج.
const fmt=iso=>{const d=new Date(iso);if(!iso||isNaN(d))return"—";const p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};
const Badge=({st})=><span className={"g-badge "+st.tone}><i/>{st.ar}</span>;
const Ph=({u,t})=>u?<a className="fq-ph" href={u} target="_blank" rel="noopener noreferrer"><Icon n="eye" s={12}/> {t}</a>:null;

// tv: معرّفات الدراجات التجريبية (من صفحة الأسطول) — تظهر بشارة وآخر القوائم، وخارج كل عدّاد ومجموع
export default function FleetRequests({owner,tv}){
  const toast=useToast();
  const[perm,setPerm]=useState(owner?{view:true,edit:true}:null);
  const[d,setD]=useState(null);const[err,setErr]=useState(null);const[busy,setBusy]=useState(null);
  const[refs,setRefs]=useState({});const[amts,setAmts]=useState({});const[fees,setFees]=useState({});const[why,setWhy]=useState({});const[chans,setChans]=useState({});const[notes,setNotes]=useState({});const[vals,setVals]=useState({});
  const[month,setMonth]=useState(()=>riyadhMonth());
  useEffect(()=>{if(owner)return;(async()=>{const{data:{user}}=await supabase.auth.getUser();
    const{data}=await supabase.from("user_permissions").select("can_view,can_edit").eq("user_id",user&&user.id).eq("module","fleet_alerts").maybeSingle();
    setPerm({view:!!(data&&(data.can_view||data.can_edit)),edit:!!(data&&data.can_edit)});})();},[owner]);
  async function load(){
    setErr(null);
    const from=new Date(Date.now()-120*864e5).toISOString();
    const[fr,mr,al,st,fl,bl]=await Promise.all([
      supabase.from("fuel_requests").select("*").gte("requested_at",from).order("requested_at",{ascending:false}),
      supabase.from("maintenance_requests").select("*").order("requested_at",{ascending:false}).limit(200),
      supabase.rpc("fleet_alerts"),
      supabase.from("fleet_alert_settings").select("key,vehicle_id,value,updated_at"),
      supabase.from("fuel_logs").select("id,vehicle_id,plate,biker_employee_id,biker_name,odometer,amount,liters,fill_at,request_id,legacy,status,price_warn,reject_reason,receipt_photo_url,odometer_photo_url").eq("legacy",false).gte("fill_at",from).order("fill_at",{ascending:false}),
      supabase.rpc("fuel_balances"),
    ]);
    const e=[fr,mr,al,st,fl,bl].find(x=>x.error);if(e)setErr(adminRpcError(e.error));
    setD({fr:fr.data||[],mr:mr.data||[],al:al.data||[],st:st.data||[],fl:fl.data||[],bl:bl.data||[]});
  }
  useEffect(()=>{if(perm&&perm.view)load();},[perm]);

  const R=useMemo(()=>d?splitRequests(d.fr):null,[d]);
  const PF=useMemo(()=>d?pendingFills(d.fl):[],[d]);
  // بايكر تجريبي: من له طلب أو تعبئة على دراجة تجريبية
  const testBikers=useMemo(()=>new Set(d&&tv?[...d.fr,...d.fl].filter(x=>tv.has(x.vehicle_id)).map(x=>x.biker_employee_id):[]),[d,tv]);
  const BL=useMemo(()=>d?[...d.bl].sort((a,b)=>Number(testBikers.has(a.biker_employee_id))-Number(testBikers.has(b.biker_employee_id))||Number(a.balance)-Number(b.balance)):[],[d,testBikers]);
  const O=useMemo(()=>d?splitOil(d.mr):null,[d]);
  const G=useMemo(()=>d?markTest(alertsByVehicle(d.al),tv):[],[d,tv]);
  const C=useMemo(()=>d?markTest(monthlyCostPerKm(month,d.fr,d.fl),tv):[],[d,month,tv]);
  const nr=a=>realBy(a,tv).length,tb=r=>tv&&tv.has(r.vehicle_id)&&<TestBadge/>;
  const fillsOf=id=>d?d.fl.filter(f=>f.request_id===id):[];
  const glob=k=>{const r=d&&d.st.find(s=>s.key===k&&!s.vehicle_id);return r?r.value:null;};
  const overrides=d?d.st.filter(s=>s.vehicle_id&&s.value!=null):[];
  const plateOf=id=>{const x=d&&(d.fr.find(r=>r.vehicle_id===id)||d.mr.find(r=>r.vehicle_id===id));return x?x.plate:"—";};

  async function call(key,fn,args,ok){
    setBusy(key);let error;
    try{({error}=await supabase.rpc(fn,args));}catch(e){error=e;}finally{setBusy(null);}
    if(error){toast.bad(walletAdminError(error)||adminRpcError(error),undefined,6000);return false;}
    toast.ok(ok);load();return true;
  }
  // التحويل بالأسماء (p_bank_txn): للدالة نسختان والقديمة مغلقة
  const amtOf=r=>amts[r.id]!==undefined?amts[r.id]:String(r.amount??50),feeOf=r=>fees[r.id]!==undefined?fees[r.id]:"0.58";
  const transfer=r=>{const f={txn:refs[r.id],amount:amtOf(r),fee:feeOf(r)};const e=transferFormError(f);if(e){toast.bad(e);return;}
    call("tr"+r.id,"transfer_fuel_request",{p_id:r.id,p_bank_txn:String(f.txn).trim(),p_amount_actual:parseNum(f.amount),p_fee:parseNum(f.fee)},"سُجِّل التحويل — أُضيف لرصيد البايكر ووصله إشعار");};
  const rejectReq=r=>{const w=(why["r"+r.id]||"").trim();if(!w){toast.bad("اكتب سبب الرفض");return;}call("rj"+r.id,"reject_fuel_request",{p_id:r.id,p_reason:w},"رُفض الطلب — وصل البايكرَ إشعارٌ بالسبب");};
  const review=(f,okk)=>{const w=(why["f"+f.id]||"").trim();if(!okk&&!w){toast.bad("اكتب سبب الرفض");return;}
    call("rv"+f.id,"review_fuel_fill",{p_id:f.id,p_ok:okk,p_reason:okk?null:w},okk?"اعتُمدت التعبئة":"رُفضت التعبئة — عاد مبلغها لرصيد البايكر");};
  const tbB=id=>testBikers.has(id)&&<TestBadge/>;
  const send=r=>{const ch=chans[r.id];if(!ch){toast.bad("اختر قناة الإرسال");return;}call("se"+r.id,"send_oil_to_sweater",{p_id:r.id,p_channel:ch},"سُجِّل الإرسال لسويتر");};
  const approve=r=>call("ap"+r.id,"approve_oil_change",{p_id:r.id,p_note:(notes[r.id]||"").trim()||null},"اعتُمد تغيير الزيت — أُضيف لسجل صيانة الدراجة");
  const saveSet=k=>{const v=vals[k];const e=settingError(k,v);if(e){toast.bad(e);return;}call("st"+k,"set_fleet_alert_setting",{p_key:k,p_value:parseNum(v)},"حُفظ الحدّ").then(ok=>{if(ok)setVals(p=>({...p,[k]:undefined}));});};

  if(perm===null)return<div className="fq"><style>{CSS}</style><div className="fq-empty">…</div></div>;
  if(!perm.view)return<div className="fq"><style>{CSS}</style><div className="fq-empty"><Icon n="lock" s={22}/><b>لا صلاحية</b><span>تحتاج وحدة «طلبات الأسطول وتنبيهاته» في صفحة المستخدمين.</span></div></div>;
  const ed=perm.edit;
  return(<div className="fq"><style>{CSS}</style>
    {err&&<div className="fq-msg err">{err}</div>}
    {!d?<div className="fq-empty">جارٍ التحميل…</div>:<>
    <div className="fq-kpis">
      <div className={"fq-kpi"+(nr(R.pending)?" hot":"")}><b>{nr(R.pending)}</b><span>دفعات بانتظار التحويل</span></div>
      <div className={"fq-kpi"+(nr(PF)?" hot":"")}><b>{nr(PF)}</b><span>تعبئات بانتظار الاعتماد</span></div>
      <div className="fq-kpi"><b>{nr(O.requested)}</b><span>زيت بانتظار الإرسال</span></div>
      <div className="fq-kpi"><b>{nr(O.done)}</b><span>زيت بانتظار الاعتماد</span></div>
      <div className="fq-kpi"><b>{realBy(d.al,tv).filter(a=>a.severity==="warn").length}</b><span>تحذيرات</span></div>
    </div>

    {/* ١) دفعات الرصيد بانتظار التحويل (تلقائية أو مستعجلة): رقم العملية والمبلغ الفعلي والرسوم، أو رفض بسبب */}
    <section className={"fq-sec"+(nr(R.pending)?" hot":"")}>
      <h3><Icon n="fuel" s={16}/> دفعات بانتظار التحويل <span className="fq-c">{nr(R.pending)}</span></h3>
      {R.pending.length===0?<div className="fq-none">لا دفعات معلّقة.</div>:R.pending.map(r=><div className="fq-row" key={r.id}>
        <div className="fq-main"><b>{r.plate||"—"} · {r.biker_name||r.biker_employee_id} <span className={"g-badge "+(r.source==="urgent"?"warn":"info")}><i/>{SOURCE_AR[r.source]||r.source||"—"}</span> {tb(r)}</b>
          <span>{sar(r.amount)}﷼ · منذ {since(r.requested_at)} · {fmt(r.requested_at)}{r.odometer!=null?" · العدّاد "+r.odometer:""}</span>
          {r.reason&&<span>السبب: {r.reason}</span>}
          <Ph u={r.odometer_photo_url} t="صورة العدّاد"/></div>
        {ed&&<div className="fq-act fq-tr">
          <input className="g-input" placeholder="رقم العملية البنكية" value={refs[r.id]||""} onChange={e=>setRefs(p=>({...p,[r.id]:e.target.value}))} maxLength={200}/>
          <label>المبلغ<input className="g-input fq-n" inputMode="decimal" value={amtOf(r)} onChange={e=>setAmts(p=>({...p,[r.id]:e.target.value}))}/></label>
          <label>الرسوم<input className="g-input fq-n" inputMode="decimal" value={feeOf(r)} onChange={e=>setFees(p=>({...p,[r.id]:e.target.value}))}/></label>
          <button className="g-btn primary" disabled={busy==="tr"+r.id} onClick={()=>transfer(r)}><Icon n="check" s={14}/> حوِّل</button>
          <input className="g-input" placeholder="سبب الرفض" value={why["r"+r.id]||""} onChange={e=>setWhy(p=>({...p,["r"+r.id]:e.target.value}))} maxLength={500}/>
          <button className="g-btn" disabled={busy==="rj"+r.id} onClick={()=>rejectReq(r)}><Icon n="x" s={14}/> ارفض</button></div>}
      </div>)}
    </section>

    {/* ١ب) تعبئات بانتظار الاعتماد — السعر خارج النطاق تحذير للمراجع لا رفض */}
    <section className={"fq-sec"+(nr(PF)?" hot":"")}>
      <h3><Icon n="doc" s={16}/> تعبئات بانتظار الاعتماد <span className="fq-c">{nr(PF)}</span></h3>
      {PF.length===0?<div className="fq-none">لا تعبئات بانتظار المراجعة.</div>:PF.map(f=>{const pl=pricePerLiter(f);return<div className="fq-row" key={f.id}>
        <div className="fq-main"><b>{f.plate||"—"} · {f.biker_name||f.biker_employee_id} {f.price_warn&&<span className="g-badge warn"><i/>⚠️ سعر اللتر خارج النطاق</span>} {tb(f)}</b>
          <span>{sar(f.amount)}﷼ · {f.liters!=null?sar(f.liters)+" لتر":"— لتر"} · {pl!=null?pl+" ﷼/لتر":"—"} · العدّاد {f.odometer??"—"} · {fmt(f.fill_at)}</span>
          <span className="fq-phs"><Ph u={f.receipt_photo_url} t="الفاتورة"/><Ph u={f.odometer_photo_url} t="العدّاد"/></span></div>
        {ed&&<div className="fq-act">
          <button className="g-btn primary" disabled={busy==="rv"+f.id} onClick={()=>review(f,true)}><Icon n="check" s={14}/> اعتماد</button>
          <input className="g-input" placeholder="سبب الرفض" value={why["f"+f.id]||""} onChange={e=>setWhy(p=>({...p,["f"+f.id]:e.target.value}))} maxLength={500}/>
          <button className="g-btn" disabled={busy==="rv"+f.id} onClick={()=>review(f,false)}><Icon n="x" s={14}/> ارفض</button></div>}
      </div>;})}
    </section>

    {/* ١ج) رصيد كل بايكر: المحوَّل − المصروف (غير المرفوض) منذ بداية الرصيد */}
    <section className="fq-sec">
      <h3><Icon n="cash" s={16}/> أرصدة الوقود</h3>
      {BL.length===0?<div className="fq-none">لا أرصدة بعد.</div>:<div className="fq-tw"><table className="fq-t"><thead><tr><th>البايكر</th><th>المحوَّل</th><th>المصروف</th><th>الرصيد</th><th>بانتظار الاعتماد</th><th>دفعة مفتوحة</th></tr></thead>
        <tbody>{BL.map(b=><tr key={b.biker_employee_id}><td>{b.biker_name||b.biker_employee_id} {tbB(b.biker_employee_id)}</td><td>{sar(b.transferred)}﷼</td><td>{sar(b.spent)}﷼</td>
          <td><b>{sar(b.balance)}﷼</b></td><td>{b.pending_fills||0}</td><td>{b.open_request_id?`${SOURCE_AR[b.open_source]||""} · منذ ${since(b.open_since)}`:"—"}</td></tr>)}</tbody></table></div>}
    </section>

    {/* ٢) الزيت */}
    <section className="fq-sec">
      <h3><Icon n="bike" s={16}/> طلبات تغيير الزيت</h3>
      {O.requested.length+O.sent.length+O.done.length===0&&<div className="fq-none">لا طلبات زيت مفتوحة.</div>}
      {O.requested.map(r=><div className="fq-row" key={r.id}>
        <div className="fq-main"><b>{r.plate||"—"} · {r.biker_name||r.biker_employee_id} <Badge st={statusOf(OIL_STATUS,r.status)}/> {tb(r)}</b>
          <span>العدّاد {r.odometer} · منذ {since(r.requested_at)}</span><Ph u={r.odometer_photo_url} t="صورة العدّاد"/></div>
        {ed&&<div className="fq-act"><select className="g-input" value={chans[r.id]||""} onChange={e=>setChans(p=>({...p,[r.id]:e.target.value}))}><option value="">القناة…</option>{CHANNELS.map(c=><option key={c.k} value={c.k}>{c.ar}</option>)}</select>
          <button className="g-btn primary" disabled={busy==="se"+r.id} onClick={()=>send(r)}><Icon n="send" s={14}/> أُرسل لسويتر</button></div>}
      </div>)}
      {O.sent.map(r=><div className="fq-row" key={r.id}>
        <div className="fq-main"><b>{r.plate||"—"} · {r.biker_name||r.biker_employee_id} <Badge st={statusOf(OIL_STATUS,r.status)}/> {tb(r)}</b>
          <span>أُرسل {fmt(r.sent_at)} عبر {channelAr(r.sent_channel)} · بانتظار تأكيد الدرّاج</span></div></div>)}
      {O.done.map(r=><div className="fq-row" key={r.id}>
        <div className="fq-main"><b>{r.plate||"—"} · {r.biker_name||r.biker_employee_id} <Badge st={statusOf(OIL_STATUS,r.status)}/> {tb(r)}</b>
          <span>العدّاد بعد التغيير {r.done_odometer} · مسؤول سويتر: {r.sweater_tech_name||"—"} · {fmt(r.done_at)}</span>
          <span className="fq-phs"><Ph u={r.done_odometer_photo_url} t="العدّاد"/><Ph u={r.done_proof_url} t="الفاتورة/الملصق"/></span></div>
        {ed&&<div className="fq-act"><input className="g-input" placeholder="ملاحظة (اختياري)" value={notes[r.id]||""} onChange={e=>setNotes(p=>({...p,[r.id]:e.target.value}))} maxLength={1000}/>
          <button className="g-btn primary" disabled={busy==="ap"+r.id} onClick={()=>approve(r)}><Icon n="check" s={14}/> اعتماد</button></div>}
      </div>)}
    </section>

    {/* ٣) تنبيهات الأسطول — لكل دراجة */}
    <section className="fq-sec">
      <h3><Icon n="alert" s={16}/> تنبيهات الأسطول <span className="fq-c">{nr(d.al)}</span></h3>
      {G.length===0?<div className="fq-none">لا تنبيهات مفتوحة.</div>:G.map(g=><div className="fq-veh" key={g.vehicle_id||g.plate}>
        <div className="fq-vh"><Icon n="bike" s={14}/> {g.plate} {g.test&&<TestBadge/>}</div>
        {g.items.map((a,i)=><div className={"fq-al "+a.severity} key={a.kind+a.ref_id+i}>
          <Icon n={(ALERT_KINDS[a.kind]||{}).ic||"alert"} s={13}/><div><b>{alertAr(a.kind)}</b><span>{a.detail}</span><small>{fmt(a.at)}</small></div></div>)}
      </div>)}
    </section>

    {/* ٤) تكلفة الكيلو الشهرية — عرض لا تنبيه، لكل دراجة */}
    <section className="fq-sec">
      <h3><Icon n="cash" s={16}/> تكلفة الكيلو لكل دراجة
        <select className="g-input fq-mon" value={month} onChange={e=>setMonth(e.target.value)}>{[0,1,2,3].map(i=>{const[y,m]=riyadhMonth().split("-").map(Number);const x=new Date(Date.UTC(y,m-1-i,15));const k=x.toISOString().slice(0,7);return<option key={k} value={k}>{k}</option>;})}</select></h3>
      {C.length===0?<div className="fq-none">لا تحويلات أو قراءات في هذا الشهر.</div>:<div className="fq-tw"><table className="fq-t"><thead><tr><th>الدراجة</th><th>التحويلات</th><th>المسافة</th><th>﷼/كم</th></tr></thead>
        <tbody>{C.map(r=><tr key={r.vehicle_id}><td>{r.plate} {r.test&&<TestBadge/>}</td><td>{r.amount}﷼</td><td>{r.km} كم</td><td>{r.perKm==null?"—":r.perKm}</td></tr>)}</tbody></table></div>}
    </section>

    {/* ٥) آخر الطلبات المحوَّلة والمغلقة وتعبئاتها */}
    <section className="fq-sec">
      <h3><Icon n="doc" s={16}/> آخر الطلبات</h3>
      {[...R.transferred,...R.closed].slice(0,20).map(r=>{const fs=fillsOf(r.id);return<div className="fq-row" key={r.id}>
        <div className="fq-main"><b>{r.plate||"—"} · {r.biker_name||r.biker_employee_id} <Badge st={statusOf(FUEL_STATUS,r.status)}/> {tb(r)}</b>
          <span>{sar(r.amount_actual??r.amount)}﷼{Number(r.fee)>0?` (+${sar(r.fee)} رسوم)`:""} · {r.bank_txn||r.transfer_ref||"—"} · {r.transferred_at?"حُوِّل "+fmt(r.transferred_at):r.reject_reason||"—"} · {fs.length} تعبئة</span>
          {fs.length>0&&<span className="fq-phs">{fs.map(f=><Ph key={f.id} u={f.receipt_photo_url} t={"فاتورة "+(f.amount||"")+"﷼ · "+fillStatus(f.status).ar}/>)}</span>}</div></div>;})}
      {R.transferred.length+R.closed.length===0&&<div className="fq-none">لا طلبات بعد.</div>}
    </section>

    {/* ٦) الحدود */}
    <section className="fq-sec">
      <h3><Icon n="edit" s={16}/> حدود التنبيهات</h3>
      <div className="fq-sets">{SETTINGS.map(s=>{const v=vals[s.k];const cur=glob(s.k);return<div className="fq-set" key={s.k}>
        <span>{s.ar}</span>
        <div className="fq-setv"><input className="g-input" inputMode="decimal" disabled={!ed} value={v!==undefined?v:(cur??"")} onChange={e=>setVals(p=>({...p,[s.k]:e.target.value}))}/><em>{s.unit}</em>
          {ed&&v!==undefined&&String(v)!==String(cur)&&<button className="g-btn primary" disabled={busy==="st"+s.k} onClick={()=>saveSet(s.k)}>حفظ</button>}</div></div>;})}</div>
      {overrides.length>0&&<div className="fq-none">تجاوزات لدراجات: {overrides.map(o=>`${plateOf(o.vehicle_id)}: ${(SETTINGS.find(x=>x.k===o.key)||{}).ar||o.key} = ${o.value}`).join(" · ")}</div>}
    </section>
    </>}
  </div>);
}

const CSS=`
.fq{display:flex;flex-direction:column;gap:14px;max-width:980px}
.fq-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700}.fq-msg.err{background:var(--bad-bg);color:var(--bad-ink)}
.fq-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:40px 16px;color:var(--mut);font-size:13px;text-align:center}.fq-empty b{color:var(--ink);font-size:15px}
.fq-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.fq-kpi{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:2px;box-shadow:var(--shadow)}
.fq-kpi b{font-size:21px;font-weight:800}.fq-kpi span{font-size:11.5px;color:var(--mut);font-weight:600}
.fq-kpi.hot{background:var(--warn-bg);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}.fq-kpi.hot b{color:var(--warn-ink)}
.fq-sec{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow)}
.fq-sec.hot{border:2px solid var(--warn);background:color-mix(in srgb,var(--warn-bg) 60%,var(--glass))}
.fq-sec h3{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;margin:0 0 10px;flex-wrap:wrap}
.fq-c{background:var(--soft);border-radius:20px;padding:1px 9px;font-size:11.5px;color:var(--mut)}
.fq-none{font-size:12px;color:var(--mut);padding:6px 2px}
.fq-row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--line);padding:10px 0}
.fq-row:first-of-type{border-top:0}
.fq-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1 1 260px}
.fq-main b{font-size:13px;font-weight:800;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.fq-main>span{font-size:11.5px;color:var(--mut)}
.fq-phs{display:flex;gap:6px;flex-wrap:wrap}
.fq-ph{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--info-ink);background:var(--info-bg);border-radius:8px;padding:2px 8px;text-decoration:none;width:max-content}
.fq-act{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.fq-act .g-input{width:190px;min-height:38px}
.fq-tr label{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mut);font-weight:700}.fq-act .g-input.fq-n{width:72px}
.fq-veh{border-top:1px solid var(--line);padding:9px 0}.fq-veh:first-of-type{border-top:0}
.fq-vh{display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px;margin-bottom:6px}
.fq-al{display:flex;gap:8px;align-items:flex-start;border-radius:10px;padding:7px 10px;margin-bottom:5px;background:var(--info-bg);color:var(--info-ink)}
.fq-al.warn{background:var(--warn-bg);color:var(--warn-ink)}
.fq-al div{display:flex;flex-direction:column;gap:1px}.fq-al b{font-size:12.5px}.fq-al span{font-size:12px;color:var(--ink-2)}.fq-al small{font-size:10.5px;opacity:.75}
.fq-mon{width:auto;min-height:32px;margin-inline-start:auto;font-size:12px}
.fq-tw{overflow-x:auto}.fq-t{width:100%;border-collapse:collapse;font-size:12.5px}.fq-t th,.fq-t td{text-align:right;padding:7px 8px;border-bottom:1px solid var(--line)}.fq-t th{color:var(--mut);font-weight:700;font-size:11.5px}
.fq-sets{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fq-set{display:flex;flex-direction:column;gap:5px;border:1px solid var(--line);border-radius:11px;padding:9px 10px;font-size:12px;font-weight:600}
.fq-setv{display:flex;align-items:center;gap:6px}.fq-setv .g-input{width:110px;min-height:36px}.fq-setv em{font-style:normal;color:var(--mut);font-size:11.5px}
@media(max-width:640px){.fq-kpis{grid-template-columns:1fr 1fr}.fq-sets{grid-template-columns:1fr}.fq-act{width:100%}.fq-act .g-input{flex:1;width:auto}}
`;
